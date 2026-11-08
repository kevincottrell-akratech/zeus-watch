// Server-only demo credentials. Never return this configuration to a client.
export function demoCredentials(env, fallbackPassword) {
 const coordinator=env.DEMO_COORDINATOR_PASSWORD;
 const volunteer=env.DEMO_VOLUNTEER_PASSWORD;
 const roleMode=!!(coordinator||volunteer);
 if(roleMode&&(
  typeof coordinator!=='string'||typeof volunteer!=='string'||
  coordinator.trim().length<12||volunteer.trim().length<12||coordinator===volunteer
 ))throw Error('Demo role passwords must both be set, distinct, and at least 12 characters each.');

 let accounts=null;
 if(env.DEMO_PASSWORDS_JSON){
  // JSON parse errors may quote the input, so replace them with a safe message.
  try{accounts=JSON.parse(env.DEMO_PASSWORDS_JSON)}catch{throw Error('Invalid demo account password configuration.');}
  if(!accounts||typeof accounts!=='object'||Array.isArray(accounts))throw Error('Invalid demo account password configuration.');
  const values=Object.values(accounts);
  if(values.length<2||values.some(p=>typeof p!=='string'||p.length<12)||new Set(values).size!==values.length)
   throw Error('Account passwords must be distinct, at least 12 characters each.');
  if(roleMode&&Object.entries(accounts).some(([name,p])=>name.toLowerCase()==='admin'&&(p===coordinator||p===volunteer)))
   throw Error('Demo role passwords must differ from the administrator password.');
 }
 if(env.NODE_ENV==='production'&&!accounts&&!roleMode)
  throw Error('Hosted production mode requires distinct account credentials or distinct demo role passwords.');
 if(!accounts&&!roleMode&&(!fallbackPassword||fallbackPassword.length<12))
  throw Error('DEMO_PASSWORD must be set to at least 12 characters. Never commit it.');

 return user=>{
  if(!user)return undefined;
  if(roleMode&&user.role==='coordinator')return coordinator;
  if(roleMode&&user.role==='volunteer')return volunteer;
  // Role mode never gives its passwords to an administrator or unknown role.
  const username=user.alias.toLowerCase();
  return accounts?(Object.hasOwn(accounts,username)?accounts[username]:undefined):roleMode?undefined:fallbackPassword;
 };
}
