import type { StoreApi } from "zustand";

import type { GameState } from "@/types";

export type SetState = StoreApi<GameState>["setState"];
export type GetState = StoreApi<GameState>["getState"];
