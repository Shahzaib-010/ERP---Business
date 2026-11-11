// Showroom content for the public landing page.
// PLACEHOLDER DEMO MODELS: names, specs and colours are made up for the showcase.
// Replace them with the real bikes on display before going live.

export const SHOWROOM_MODELS = [
  {
    id: "city-70",
    name: "City 70",
    tagline: "Light, simple and easy on fuel. Built for daily rides around town.",
    style: "commuter",
    specs: [
      { label: "Engine", value: "70 cc" },
      { label: "Gears", value: "4-speed" },
      { label: "Fuel tank", value: "8.5 L" },
      { label: "Weight", value: "82 kg" },
    ],
    colors: [
      { name: "Classic Red", hex: "#c8102e" },
      { name: "Jet Black", hex: "#16171b" },
      { name: "Royal Blue", hex: "#1f4fd1" },
      { name: "Pearl White", hex: "#eceae4" },
    ],
  },
  {
    id: "street-125",
    name: "Street 125",
    tagline: "More power and a bigger tank for longer trips and city traffic.",
    style: "street",
    specs: [
      { label: "Engine", value: "125 cc" },
      { label: "Gears", value: "5-speed" },
      { label: "Fuel tank", value: "12 L" },
      { label: "Weight", value: "108 kg" },
    ],
    colors: [
      { name: "Metallic Black", hex: "#0f1012" },
      { name: "Racing Red", hex: "#b3121f" },
      { name: "Graphite Grey", hex: "#5b6068" },
      { name: "Sunset Orange", hex: "#e2621b" },
    ],
  },
  {
    id: "roadster-150",
    name: "Roadster 150",
    tagline: "Sporty fairing, sharp looks and a confident ride on the highway.",
    style: "sport",
    specs: [
      { label: "Engine", value: "150 cc" },
      { label: "Gears", value: "5-speed" },
      { label: "Fuel tank", value: "13 L" },
      { label: "Weight", value: "135 kg" },
    ],
    colors: [
      { name: "Electric Blue", hex: "#1546c2" },
      { name: "Matte Black", hex: "#1b1c1f" },
      { name: "Glacier White", hex: "#f2f3f5" },
      { name: "Lime Green", hex: "#5aa31e" },
    ],
  },
];

export const SHOWROOM_HIGHLIGHTS = [
  { title: "See every colour in person", text: "Bikes on display in the showroom, ready to look at and compare." },
  { title: "New and used motorcycles", text: "A range of models to choose from, all in one place." },
  { title: "Friendly local dealer", text: "Visit us in the Auto Market, Rahim Yar Khan, and talk to us directly." },
];
