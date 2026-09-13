import type { Metadata } from "next";
import { BuildingGallery } from "../../components/buildings/BuildingGallery";

export const metadata: Metadata = {
  title: "Building collection — Tourist",
  description: "Explore the pixel-art architecture behind every file in Tourist’s repository city.",
};

export default function BuildingsPage() {
  return <BuildingGallery />;
}
