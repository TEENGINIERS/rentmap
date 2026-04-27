"use client";
import { create } from "zustand";
import type { ListingCardDTO } from "@/lib/db/queries/listings";

export interface MapFocus {
  lat: number;
  lng: number;
  zoom?: number;
}

export interface MapPoi {
  name: string;
  lat: number;
  lng: number;
  category: string;
}

interface ListingsState {
  /** Listings from chat tool calls. null = "no chat results yet, use SSR seed". */
  chatListings: ListingCardDTO[] | null;
  /** Last geocode/find_area result — map flies here. */
  focus: MapFocus | null;
  /** POI markers (metro/mall/etc) from nearby_places. */
  pois: MapPoi[];

  setChatListings: (listings: ListingCardDTO[]) => void;
  setFocus: (focus: MapFocus | null) => void;
  setPois: (pois: MapPoi[]) => void;
  reset: () => void;
}

export const useListingsStore = create<ListingsState>((set) => ({
  chatListings: null,
  focus: null,
  pois: [],
  setChatListings: (chatListings) => set({ chatListings }),
  setFocus: (focus) => set({ focus }),
  setPois: (pois) => set({ pois }),
  reset: () => set({ chatListings: null, focus: null, pois: [] }),
}));
