export type AgeKey = "3-4" | "4-5" | "5-6" | "6-7";
export const AGES: ReadonlyArray<{ key: AgeKey; label: string }> = [
  { key: "3-4", label: "3-4 года" },
  { key: "4-5", label: "4-5 лет" },
  { key: "5-6", label: "5-6 лет" },
  { key: "6-7", label: "6-7 лет" },
];

export type TopicKey = "math" | "literacy" | "world" | "speech" | "logic" | "drawing" | "sensory" | "routine";
export interface TopicStyle { key: TopicKey; label: string; bg: string; color: string; dot: string }
export const TOPICS: ReadonlyArray<TopicStyle> = [
  { key: "math", label: "Математика", bg: "#FFF3D6", color: "#8A5A00", dot: "#F2B134" },
  { key: "literacy", label: "Грамота", bg: "#E6F4F3", color: "#166562", dot: "#2BA7A0" },
  { key: "world", label: "Окружающий мир", bg: "#E8F6E4", color: "#2F7A1F", dot: "#6AB04C" },
  { key: "speech", label: "Речь", bg: "#FDE8DF", color: "#9A3A1E", dot: "#F7A08C" },
  { key: "logic", label: "Логика", bg: "#EAF1FF", color: "#2E4FB8", dot: "#5B7BE9" },
  { key: "drawing", label: "Рисование", bg: "#F3E8FF", color: "#6D3BB5", dot: "#9B5DE5" },
  { key: "sensory", label: "Сенсорика", bg: "#FFE9F2", color: "#9C2A5B", dot: "#E86AA0" },
  { key: "routine", label: "Режим дня", bg: "#ECE9E0", color: "#4A4F58", dot: "#9AA1AC" },
];

export const LOGO_SVG = "<svg width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"7.5\" cy=\"7.5\" r=\"4\" fill=\"#F2B134\"></circle><path d=\"M12.5 3.5h8v8h-8z\" fill=\"#1F8A85\"></path><path d=\"M4 20.5l5.5-9 5.5 9z\" fill=\"#D5512E\"></path></svg>";
