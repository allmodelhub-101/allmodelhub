import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {return {name:"All Model Hub",short_name:"AMH",description:"Every Leading AI. One PKR Wallet.",start_url:"/chat",display:"standalone",background_color:"#05070a",theme_color:"#05070a",icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml"}]};}
