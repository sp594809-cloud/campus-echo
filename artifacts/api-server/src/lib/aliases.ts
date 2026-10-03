const descriptors = [
  "Mysterious",
  "Silent",
  "Midnight",
  "Velvet",
  "Curious",
  "Electric",
  "Hidden",
  "Sleepy",
  "Wandering",
  "Cosmic",
  "Secret",
  "Thoughtful",
];

const animals = [
  "Owl",
  "Panda",
  "Fox",
  "Raven",
  "Tiger",
  "Otter",
  "Moth",
  "Cat",
  "Sparrow",
  "Badger",
  "Deer",
  "Gecko",
];

export function makeAnonymousAlias(): string {
  const descriptor = descriptors[Math.floor(Math.random() * descriptors.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  return `${descriptor} ${animal}`;
}