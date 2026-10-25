import { useEffect, useState } from "react";
import { AGES, type AgeKey } from "../constants/templates";

export type Route =
  | { name: "boards" }
  | { name: "templates"; age?: AgeKey }
  | { name: "groups" }
  | { name: "profile" }
  | { name: "people" };

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, "");
  const [path, query = ""] = raw.split("?");
  switch (path) {
    case "/templates": {
      const age = new URLSearchParams(query).get("age");
      const found = AGES.find((a) => a.key === age);
      return found ? { name: "templates", age: found.key } : { name: "templates" };
    }
    case "/groups":
      return { name: "groups" };
    case "/profile":
      return { name: "profile" };
    case "/people":
      return { name: "people" };
    default:
      return { name: "boards" };
  }
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case "templates":
      return r.age ? `#/templates?age=${r.age}` : "#/templates";
    case "groups":
      return "#/groups";
    case "profile":
      return "#/profile";
    case "people":
      return "#/people";
    default:
      return "#/";
  }
}

export function navigate(r: Route): void {
  window.location.hash = routeToHash(r);
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    onChange();
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
