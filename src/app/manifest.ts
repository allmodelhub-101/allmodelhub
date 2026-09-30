import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
export default function manifest(): MetadataRoute.Manifest {return {name:BRAND.name,short_name:BRAND.shortName,description:BRAND.tagline,start_url:"/chat",display:"standalone",background_color:"#05070a",theme_color:"#05070a",icons:[{src:BRAND.logoPath,sizes:"any",type:"image/png",purpose:"any"}]};}
