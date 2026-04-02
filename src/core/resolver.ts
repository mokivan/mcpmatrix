export function resolveServers(config:any){
  const set = new Set<string>();

  if(config?.scopes?.global?.enable){
    config.scopes.global.enable.forEach((s:string)=>set.add(s));
  }

  return Array.from(set);
}