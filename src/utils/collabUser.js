import { nanoid } from "nanoid";

const FIGMA_COLORS = [
  "#F24822", // Figma Red
  "#18A0FB", // Figma Blue
  "#0FA958", // Figma Green
  "#9747FF", // Figma Purple
  "#FF7262", // Figma Coral
  "#FFA629", // Figma Orange
  "#14AE5C", // Figma Emerald
  "#007BE5", // Figma Deep Blue
  "#7B61FF", // Figma Indigo
  "#E056FD", // Pinkish Violet
  "#2ED573", // Mint Green
  "#FF4757", // Bright Red
];

const USER_NAMES = [
  "Fox", "Eagle", "Falcon", "Otter", "Wolf", "Tiger", "Panda", "Koala",
  "Lion", "Cheetah", "Jaguar", "Dolphin", "Hawk", "Badger", "Owl"
];

const STORAGE_KEY_USER = "drawdb_collab_user";

export function getCollabUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.id && parsed.name && parsed.color) {
        return parsed;
      }
    }
  } catch {
    // Ignore JSON errors
  }

  const randomAnimal = USER_NAMES[Math.floor(Math.random() * USER_NAMES.length)];
  const randomColor = FIGMA_COLORS[Math.floor(Math.random() * FIGMA_COLORS.length)];
  const id = `u_${nanoid(6)}`;
  const newUser = {
    id,
    name: `User ${randomAnimal}`,
    color: randomColor,
  };

  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
  } catch {
    // Ignore localStorage errors
  }

  return newUser;
}

export function saveCollabUser(user) {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } catch {
    // Ignore
  }
}
