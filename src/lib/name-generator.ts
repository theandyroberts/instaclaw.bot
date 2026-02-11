const adjectives = [
  "gingerbread", "velvet", "cosmic", "amber", "crystal", "emerald", "golden",
  "marble", "silver", "copper", "scarlet", "indigo", "saffron", "jasmine",
  "cedar", "maple", "willow", "ivory", "cobalt", "crimson", "azure", "coral",
  "sage", "frosty", "sunny", "misty", "breezy", "starlit", "midnight", "autumn",
  "lunar", "gentle", "brave", "clever", "nimble", "swift", "steady", "bright",
  "calm", "bold", "merry", "noble", "witty", "vivid", "plucky", "cheerful",
  "dapper", "zippy", "quirky", "peppy", "snappy", "sparky", "lively", "perky",
  "jazzy", "cozy", "fancy", "nifty", "lucky", "happy", "jolly", "biscuit",
  "caramel", "cinnamon", "nutmeg", "vanilla", "cocoa", "truffle", "honeydew",
  "clementine", "tangerine", "blueberry", "raspberry", "cherry", "peach",
  "apricot", "mango", "papaya", "coconut", "pistachio", "walnut", "almond",
  "hazelnut", "pretzel", "waffle", "pancake",
];

const names = [
  "harvey", "penny", "felix", "olive", "charlie", "ruby", "oscar", "daisy",
  "jasper", "hazel", "winston", "iris", "clyde", "pearl", "otis", "flora",
  "archie", "stella", "percy", "mabel", "rufus", "poppy", "walter", "cleo",
  "hugo", "wilma", "basil", "fern", "ernie", "luna", "monty", "nora", "ralph",
  "ivy", "alfie", "bess", "cecil", "dot", "eddie", "greta", "hank", "june",
  "kirby", "lola", "miles", "nell", "otto", "quinn", "rex", "tess", "vince",
  "wren", "agnes", "burt", "cora", "duke", "elsie", "finn", "gus", "hope",
  "ike", "jade", "kit", "leah", "max", "nia", "opal", "pax", "reed", "sage",
  "tate", "vera", "ziggy", "beau", "clara", "dean", "eve", "frank", "gwen",
  "hal", "isla", "jack", "kate", "leo", "mae", "ned", "ora", "pip", "rose",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateBotName(): string {
  return `${pick(adjectives)}_${pick(names)}_bot`;
}
