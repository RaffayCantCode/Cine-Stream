import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { Home } from "@/pages/Home";
import { MovieDetail } from "@/pages/MovieDetail";
import { TvDetail } from "@/pages/TvDetail";
import { Search } from "@/pages/Search";
import { BrowseMovies } from "@/pages/BrowseMovies";
import { BrowseTv } from "@/pages/BrowseTv";
import { WatchMovie, WatchTv } from "@/pages/WatchPage";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000 } },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/movie/:id" component={MovieDetail} />
      <Route path="/tv/:id" component={TvDetail} />
      <Route path="/search" component={Search} />
      <Route path="/browse/movies" component={BrowseMovies} />
      <Route path="/browse/tv" component={BrowseTv} />
      <Route path="/watch/movie/:id" component={WatchMovie} />
      <Route path="/watch/tv/:id/:season/:episode" component={WatchTv} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
