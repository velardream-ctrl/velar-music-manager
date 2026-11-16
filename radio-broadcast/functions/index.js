'use strict';
// VELAR RADIO controller. API keys stay in Firebase Secret Manager.
const {onCall, HttpsError} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
initializeApp();
const azuraKey = defineSecret('AZURACAST_API_KEY');
function serverConfig() {
  const base=(process.env.AZURACAST_URL||'').trim();
  const station=(process.env.AZURACAST_STATION_ID||'').trim();
  if (!/^https:\/\/[a-z0-9.-]+(?::[0-9]{2,5})?\/?$/i.test(base) ||
      !/^[1-9][0-9]{0,7}$/.test(station)) {
    throw new HttpsError('failed-precondition','Сервер вещания ещё не подключён.');
  }
  return {base:base.replace(/\/$/,''),station};
}
async function requestStation(cfg,path,method) {
  const key=azuraKey.value();
  if (!key) throw new HttpsError('failed-precondition','Ключ сервера радио не настроен.');
  let response;
  try {
    response=await fetch(cfg.base+'/api/station/'+cfg.station+'/'+path,{
      method:method||'GET',headers:{'X-API-Key':key,Accept:'application/json'},
      signal:AbortSignal.timeout(12000)
    });
  } catch (_) {throw new HttpsError('unavailable','Сервер вещания не отвечает.');}
  if (!response.ok) throw new HttpsError('unavailable','Сервер отклонил команду (HTTP '+response.status+').');
  if(path!=='status')return {};
  try{return await response.json();}catch(_){return {};}
}
function running(value){
  if (!value || typeof value!=='object') return null;
  if (typeof value.running==='boolean')return value.running;
  if (typeof value.is_running==='boolean')return value.is_running;
  return null;
}
exports.velarRadioControl = onCall({
  secrets:[azuraKey],cors:['https://velardream.com']
},async request=>{
  const auth=request.auth,token=auth&&auth.token;
  if (!auth || token.email_verified!==true ||
    !(token.firebase&&token.firebase.sign_in_provider==='google.com')) {
    throw new HttpsError('unauthenticated','Требуется подтверждённый вход через Google.');
  }
  const admin=await getFirestore().doc('vmm_admins/'+auth.uid).get();
  if (!admin.exists || !admin.data() || admin.data().enabled!==true)
    throw new HttpsError('permission-denied','Нет прав управления радио.');
  const action=request.data&&request.data.action;
  if (!['status','start','stop'].includes(action))
    throw new HttpsError('invalid-argument','Неизвестная команда.');
  const cfg=serverConfig();
  if (action!=='status') {
    const steps=action==='start'?['frontend/start','backend/start']:['backend/stop','frontend/stop'];
    for (const path of steps) await requestStation(cfg,path,'POST');
  }
  const state=await requestStation(cfg,'status','GET');
  return {accepted:true,command:action,frontendRunning:running(state.frontend),
    backendRunning:running(state.backend)};
});
