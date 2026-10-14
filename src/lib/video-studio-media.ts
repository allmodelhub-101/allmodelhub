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

const grid = (number: number, category: VideoStudioClip["category"], title: string, description: string, orientation: VideoOrientation, hasAudio: boolean, sourceDurationSeconds: number): VideoStudioClip => {
  const id = `studio-${String(number).padStart(2, "0")}`;
  return { id, category, title, description, orientation, hasAudio, sourceDurationSeconds,
  gridSrc: `/video-studio/demo/previews/${id}.mp4`,
  fullSrc: `/video-studio/demo/full/${id}.mp4`,
  poster: `/video-studio/demo/posters/${id}.jpg` };
};

// Full-duration web encodes of the user's 16 supplied originals. Gallery files
// are smaller encodes, not shortened teasers. See docs/VIDEO_STUDIO_MEDIA.md.
export const videoStudioClips: VideoStudioClip[] = [
  grid(1, "Cinematic", "Monochrome tension", "A stark, dramatic crowd sequence.", "landscape", true, 27.04),
  grid(2, "Product", "Night drive", "Sculpted automotive light after dark.", "portrait", true, 9.71),
  grid(3, "Portrait", "Interior portrait", "Quiet character detail and natural motion.", "portrait", false, 8.04),
  grid(4, "Cinematic", "Dark procession", "A theatrical scene with striking contrast.", "portrait", true, 30.04),
  grid(5, "Social / Vlog", "Everyday stories", "A candid indoor moment.", "portrait", true, 7.04),
  grid(6, "Product", "Automotive detail", "A close view of sculpted surfaces.", "portrait", false, 20.04),
  grid(7, "Cinematic", "A wider perspective", "An aerial view with a sense of scale.", "portrait", true, 22.04),
  grid(8, "Portrait", "Character in focus", "Expressive character-led storytelling.", "portrait", true, 30.04),
  grid(9, "Portrait", "Profile study", "A composed portrait in motion.", "portrait", true, 18.04),
  grid(10, "Creative / Character", "Glass worlds", "A miniature world with an imaginative twist.", "portrait", true, 11.72),
  grid(11, "Product", "After-hours ride", "A motorcycle beneath cinematic night light.", "portrait", true, 18.04),
  grid(12, "Social / Vlog", "Street style", "An immediate, candid urban moment.", "portrait", true, 30.04),
  grid(13, "Sci-Fi", "City astronaut", "A futuristic character on an urban stage.", "portrait", true, 10.04),
  grid(14, "Creative / Character", "Unexpected duet", "A playful character-led musical scene.", "square", true, 29.04),
  grid(15, "Creative / Character", "Urban surprise", "An unexpected character in a towering city.", "portrait", true, 21.04),
  grid(16, "Social / Vlog", "A little curiosity", "A playful everyday moment.", "portrait", true, 15.04)
];

export const galleryVideoClips = videoStudioClips;
export const clipsForCategory = (category: VideoStudioCategory) => videoStudioClips.filter((clip) => clip.category === category);
export const directionForCategory = (category: VideoStudioCategory) => videoStudioDirections.find((direction) => direction.category === category);
