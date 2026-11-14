"use client";

import { useState } from "react";
import { VideoTile } from "./VideoTile";
import { PlayerModal } from "./PlayerModal";
import type { PublicVideo } from "./util";

export function MoreVideos({ videos }: { videos: PublicVideo[] }) {
  const [open, setOpen] = useState<PublicVideo | null>(null);
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {videos.map((v) => (
          <VideoTile key={v.id} v={v} onOpen={setOpen} />
        ))}
      </div>
      <PlayerModal video={open} onClose={() => setOpen(null)} />
    </>
  );
}
