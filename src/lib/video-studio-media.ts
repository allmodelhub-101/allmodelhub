export type VideoStudioCategory = "Cinematic" | "Product" | "Portrait" | "Nature" | "Sci-Fi" | "Social / Vlog";

export type VideoStudioDirection = {
  category: VideoStudioCategory;
  prompt: string;
  poster: string;
  title: string;
  description: string;
};

export type VideoStudioClip = {
  id: string;
  category: Exclude<VideoStudioCategory, "Nature">;
  description: string;
  src: string;
  poster: string;
  durationSeconds: number;
  hasAudio: boolean;
};

export const videoStudioDirections: VideoStudioDirection[] = [
  { category: "Cinematic", prompt: "Cinematic mountain lake at sunrise, slow camera push-in, soft atmospheric light, detailed natural movement.", poster: "/video-studio/cinematic-poster.png", title: "Epic scenes", description: "and breathtaking worlds" },
  { category: "Product", prompt: "Premium product reveal, sculpted studio light, slow orbiting camera, precise material detail.", poster: "/video-studio/product-poster.png", title: "Showcase", description: "your products" },
  { category: "Portrait", prompt: "Expressive portrait with subtle natural movement, shallow depth of field, gentle handheld camera motion.", poster: "/video-studio/portrait-poster.png", title: "Characters", description: "and emotional stories" },
  { category: "Nature", prompt: "Waterfall in a lush forest after rain, drifting mist, cinematic wide shot and gentle camera glide.", poster: "/video-studio/nature-poster.png", title: "Beautiful", description: "natural worlds" },
  { category: "Sci-Fi", prompt: "Futuristic city at blue hour, reflections on wet streets, aerial camera motion, elegant cinematic atmosphere.", poster: "/video-studio/scifi-poster.png", title: "Futuristic", description: "and imaginative" },
  { category: "Social / Vlog", prompt: "A warm travel vlog moment in a lively market, natural handheld movement, candid detail and daylight.", poster: "/video-studio/social-poster.png", title: "Everyday", description: "moments to life" }
];

const demo = (id: string, category: VideoStudioClip["category"], description: string, durationSeconds: number, hasAudio: boolean): VideoStudioClip => ({
  id, category, description, durationSeconds, hasAudio,
  src: `/video-studio/demo/previews/${id}.mp4`,
  poster: `/video-studio/demo/posters/${id}.jpg`
});

// User-supplied, compressed Phase 2 preview assets. Nature deliberately has no clip.
export const videoStudioClips: VideoStudioClip[] = [
  demo("cinematic-monochrome", "Cinematic", "Dystopian monochrome crowd", 7, true),
  demo("product-car-night", "Product", "Cinematic sports car in a parking studio", 6, true),
  demo("product-luxury-car", "Product", "Luxury sports car exterior close-up", 6, false),
  demo("product-motorcycle", "Product", "Motorcycle close-up in street", 6, true),
  demo("portrait-indoor", "Portrait", "Interior portrait scene", 6, true),
  demo("portrait-editorial", "Portrait", "Editorial portrait sequence", 6, true),
  demo("portrait-selfie", "Portrait", "Fashion selfie portrait", 6, false),
  demo("scifi-astronaut", "Sci-Fi", "Astronaut in a city", 6, true),
  demo("scifi-underground", "Sci-Fi", "Futuristic underground scene", 6, true),
  demo("portrait-street-style", "Social / Vlog", "Urban fashion scene", 6, true)
];

export const clipsForCategory = (category: VideoStudioCategory) => videoStudioClips.filter((clip) => clip.category === category);
