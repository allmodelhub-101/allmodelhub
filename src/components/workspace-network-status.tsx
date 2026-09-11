"use client";

import { useEffect,useState } from "react";

export function WorkspaceNetworkStatus(){
 const [offline,setOffline]=useState(false);
 useEffect(()=>{const sync=()=>setOffline(!navigator.onLine);sync();window.addEventListener("online",sync);window.addEventListener("offline",sync);return()=>{window.removeEventListener("online",sync);window.removeEventListener("offline",sync)}},[]);
 if(!offline)return null;
 return <div className="network-status" role="status"><b>You’re offline.</b><span>Drafts remain on this screen, but sending and generation will wait for your connection.</span></div>
}

