import { getAnimeDetails } from "./src/lib/anime-fetch.js";

async function test() {
  console.log("Fetching Jojo 14719...");
  try {
    const data = await getAnimeDetails("14719", 1500, true);
    console.log("Success!", !!data);
    if (!data) console.log("Returned null!");
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
