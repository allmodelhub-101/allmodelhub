export type VideoStudioCategory =
  | "Cinematic"
  | "Product"
  | "Portrait"
  | "Nature"
  | "Sci-Fi"
  | "Social / Vlog"
  | "Creative / Character";

export type VideoStudioDirection = {
  category: VideoStudioCategory;
  prompt: string;
  poster: string;
  title: string;
  description: string;
};

export type VideoOrientation = "landscape" | "portrait" | "square";

/** `gridSrc` keeps gallery playback separate from the larger modal asset. */
export type VideoStudioClip = {
  id: string;
  category: Exclude<VideoStudioCategory, "Nature">;
  title: string;
  description: string;
  gridSrc: string;
  fullSrc?: string;
  poster: string;
  orientation: VideoOrientation;
  hasAudio: boolean;
  sourceDurationSeconds?: number;
};

export const videoStudioDirections: VideoStudioDirection[] = [
  { category: "Cinematic", prompt: "Cinematic wide scene with layered atmosphere, measured camera motion, and detailed natural light.", poster: "/video-studio/cinematic-poster.png", title: "Epic scenes", description: "and breathtaking worlds" },
  { category: "Product", prompt: "Premium product reveal, sculpted studio light, slow orbiting camera, and precise material detail.", poster: "/video-studio/product-poster.png", title: "Product stories", description: "with considered detail" },
  { category: "Portrait", prompt: "Expressive portrait with subtle natural movement, shallow depth of field, and a gentle handheld camera.", poster: "/video-studio/portrait-poster.png", title: "Human stories", description: "with emotional focus" },
  { category: "Nature", prompt: "Waterfall in a lush forest after rain, drifting mist, a cinematic wide shot, and gentle camera glide.", poster: "/video-studio/nature-poster.png", title: "Nature direction", description: "static until authentic footage arrives" },
  { category: "Sci-Fi", prompt: "Futuristic city at blue hour, reflections on wet streets, elegant camera motion, and a cinematic atmosphere.", poster: "/video-studio/scifi-poster.png", title: "Future worlds", description: "with cinematic scale" },
  { category: "Social / Vlog", prompt: "A warm travel-vlog moment in a lively market, natural handheld movement, candid detail, and daylight.", poster: "/video-studio/social-poster.png", title: "Everyday moments", description: "with a human point of view" },
  { category: "Creative / Character", prompt: "Character-led editorial scene with expressive styling, textured light, and subtle cinematic movement.", poster: "/video-studio/portrait-poster.png", title: "Creative characters", description: "with an editorial edge" }
];

const grid = (id: string, category: VideoStudioClip["category"], title: string, description: string, orientation: VideoOrientation, hasAudio: boolean): VideoStudioClip => ({
  id, category, title, description, orientation, hasAudio,
  gridSrc: `/video-studio/demo/previews/${id}.mp4`,
  poster: `/video-studio/demo/posters/${id}.jpg`
});

// Current committed assets are deliberately gallery-quality previews only. When
// FULL-LENGTH-v2 arrives, populate fullSrc/sourceDurationSeconds from its
// verified manifest instead of treating these teasers as full originals.
export const videoStudioClips: VideoStudioClip[] = [
  grid("cinematic-monochrome", "Cinematic", "Monochrome tension", "A stark, dramatic crowd sequence.", "landscape", true),
  grid("product-car-night", "Product", "Night drive", "Sculpted automotive light after dark.", "portrait", true),
  grid("portrait-indoor", "Portrait", "Interior portrait", "Quiet character detail and natural motion.", "portrait", true),
  grid("scifi-astronaut", "Sci-Fi", "City astronaut", "A futuristic character on an urban stage.", "portrait", true),
  grid("portrait-street-style", "Social / Vlog", "Street style", "An immediate, candid urban moment.", "portrait", true),
  grid("portrait-editorial", "Creative / Character", "Editorial character", "A composed, character-led fashion tableau.", "portrait", true)
];

export const galleryVideoClips = videoStudioClips;
export const clipsForCategory = (category: VideoStudioCategory) => videoStudioClips.filter((clip) => clip.category === category);
export const directionForCategory = (category: VideoStudioCategory) => videoStudioDirections.find((direction) => direction.category === category);
