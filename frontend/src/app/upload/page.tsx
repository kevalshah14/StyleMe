"use client";

import { AppNav } from "@/components/AppNav";
import UploadPlayground from "@/components/UploadPlayground";

export default function UploadPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AppNav />
      <UploadPlayground />
    </div>
  );
}
