import type { DispatchIntent } from "@/store/gameStore/dispatchIntent";
export type { GetState, SetState } from "../types";

export type Deps = {
  dispatchIntent: DispatchIntent;
};
