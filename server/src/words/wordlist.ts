export interface WordEntry {
  word: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

/**
 * Built-in English word list (v1). Drawable, unambiguous nouns grouped loosely
 * by category and difficulty. Custom/room-provided lists are out of scope for
 * v1 (see spec).
 */
export const WORDS: WordEntry[] = [
  // Animals
  { word: "cat", category: "animals", difficulty: "easy" },
  { word: "dog", category: "animals", difficulty: "easy" },
  { word: "fish", category: "animals", difficulty: "easy" },
  { word: "snake", category: "animals", difficulty: "easy" },
  { word: "elephant", category: "animals", difficulty: "medium" },
  { word: "penguin", category: "animals", difficulty: "medium" },
  { word: "octopus", category: "animals", difficulty: "medium" },
  { word: "hedgehog", category: "animals", difficulty: "hard" },
  { word: "chameleon", category: "animals", difficulty: "hard" },
  // Food
  { word: "apple", category: "food", difficulty: "easy" },
  { word: "pizza", category: "food", difficulty: "easy" },
  { word: "banana", category: "food", difficulty: "easy" },
  { word: "hamburger", category: "food", difficulty: "medium" },
  { word: "pancake", category: "food", difficulty: "medium" },
  { word: "pineapple", category: "food", difficulty: "medium" },
  { word: "spaghetti", category: "food", difficulty: "hard" },
  // Objects
  { word: "chair", category: "objects", difficulty: "easy" },
  { word: "clock", category: "objects", difficulty: "easy" },
  { word: "key", category: "objects", difficulty: "easy" },
  { word: "umbrella", category: "objects", difficulty: "medium" },
  { word: "telescope", category: "objects", difficulty: "medium" },
  { word: "guitar", category: "objects", difficulty: "medium" },
  { word: "lighthouse", category: "objects", difficulty: "hard" },
  { word: "typewriter", category: "objects", difficulty: "hard" },
  // Nature
  { word: "sun", category: "nature", difficulty: "easy" },
  { word: "tree", category: "nature", difficulty: "easy" },
  { word: "mountain", category: "nature", difficulty: "easy" },
  { word: "rainbow", category: "nature", difficulty: "medium" },
  { word: "volcano", category: "nature", difficulty: "medium" },
  { word: "waterfall", category: "nature", difficulty: "medium" },
  { word: "tornado", category: "nature", difficulty: "hard" },
  // Transport
  { word: "car", category: "transport", difficulty: "easy" },
  { word: "boat", category: "transport", difficulty: "easy" },
  { word: "train", category: "transport", difficulty: "easy" },
  { word: "airplane", category: "transport", difficulty: "medium" },
  { word: "helicopter", category: "transport", difficulty: "medium" },
  { word: "submarine", category: "transport", difficulty: "hard" },
  // Sports & activities
  { word: "soccer", category: "sports", difficulty: "easy" },
  { word: "skateboard", category: "sports", difficulty: "medium" },
  { word: "parachute", category: "sports", difficulty: "hard" },
  { word: "snowman", category: "misc", difficulty: "easy" },
  { word: "robot", category: "misc", difficulty: "easy" },
  { word: "castle", category: "misc", difficulty: "medium" },
  { word: "astronaut", category: "misc", difficulty: "medium" },
  { word: "windmill", category: "misc", difficulty: "hard" },
];
