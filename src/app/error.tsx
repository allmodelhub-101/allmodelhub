"use client";

import { useEffect } from "react";

export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error("Application route error",error)},[error]);
 return <main className="route-error" role="alert"><div className="card"><span className="kicker">Something went wrong</span><h1>This screen couldn’t finish loading.</h1><p>Your saved work and wallet are unchanged. Retry the screen, or return to the creation workspace.</p>{error.digest&&<small>Reference: {error.digest}</small>}<div><button className="btn btn-primary" onClick={reset}>Try again</button><a className="btn" href="/chat">Open Chat</a></div></div></main>
}

