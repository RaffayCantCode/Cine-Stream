import { NextRequest, NextResponse } from "next/server";
import { tmdbFetch } from "@/lib/tmdb";

// This is a custom API route that builds a "Similar Creators/Actors" list.
// TMDB does not have a native endpoint for this.
// Approach:
// 1. Fetch the person's combined credits.
// 2. Pick their top 3 highest-rated or most popular movies/shows.
// 3. Fetch similar movies/shows for those top 3.
// 4. Fetch the credits of those similar movies/shows.
// 5. Extract the directors (if the person is a director) or top billed actors (if an actor).
// 6. Return a deduplicated list of similar people.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // 1. Fetch person details and credits
    const person: any = await tmdbFetch(`/person/${id}?append_to_response=combined_credits`);
    
    if (!person || !person.combined_credits) {
      return NextResponse.json({ results: [] });
    }

    const isDirector = person.known_for_department === "Directing";
    const credits = isDirector ? person.combined_credits.crew : person.combined_credits.cast;

    if (!credits || credits.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // 2. Get top 3 works (mix of popular and highly rated)
    const topWorks = credits
      .filter((c: any) => (isDirector ? (c.job === "Director" || c.job === "Series Director") : true) && c.vote_count > 100)
      .sort((a: any, b: any) => (b.popularity + (b.vote_average * 10)) - (a.popularity + (a.vote_average * 10)))
      .slice(0, 3);

    if (topWorks.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const similarPeopleMap = new Map<number, any>();

    // 3 & 4. For each top work, fetch similar items and their credits
    await Promise.all(
      topWorks.map(async (work: any) => {
        try {
          const type = work.media_type === "tv" ? "tv" : "movie";
          const similarData: any = await tmdbFetch(`/${type}/${work.id}/similar`);
          const similarItems = (similarData?.results || []).slice(0, 3);

          await Promise.all(
            similarItems.map(async (item: any) => {
              try {
                const creditsData: any = await tmdbFetch(`/${type}/${item.id}/credits`);
                
                if (isDirector && creditsData?.crew) {
                  const directors = creditsData.crew.filter((c: any) => c.job === "Director" || c.job === "Series Director");
                  directors.forEach((d: any) => {
                    if (d.id !== Number(id) && d.profile_path) {
                      similarPeopleMap.set(d.id, d);
                    }
                  });
                } else if (!isDirector && creditsData?.cast) {
                  const topCast = creditsData.cast.slice(0, 5);
                  topCast.forEach((c: any) => {
                    if (c.id !== Number(id) && c.profile_path) {
                      similarPeopleMap.set(c.id, c);
                    }
                  });
                }
              } catch (err) {
                // Ignore individual fetch errors
              }
            })
          );
        } catch (err) {
          // Ignore individual fetch errors
        }
      })
    );

    // 6. Return top 10 similar people
    const similarPeople = Array.from(similarPeopleMap.values())
      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10);

    return NextResponse.json({ results: similarPeople });

  } catch (error) {
    console.error("Failed to fetch similar people:", error);
    return NextResponse.json(
      { error: "Failed to fetch similar people", results: [] },
      { status: 500 }
    );
  }
}
