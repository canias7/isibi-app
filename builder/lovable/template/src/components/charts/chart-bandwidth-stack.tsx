import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BandwidthStack } from "@/components/charts/lib/netsec"
const protocols = ["HTTPS", "Video", "Backup", "VoIP", "Other"]
const samples = Array.from({ length: 96 }, (_, i) => {
  const h = (i / 4) % 24
  const day = Math.max(0, Math.sin(((h - 6) / 24) * Math.PI * 2) + 0.35)
  return {
    t: `${String(Math.floor(h)).padStart(2, "0")}:00`,
    values: [
      Math.round(110 + day * 210), Math.round(40 + day * 250),
      h > 1 && h < 4 ? 300 : 14, Math.round(20 + day * 55), Math.round(14 + day * 26),
    ],
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Link utilisation</CardTitle>
        <CardDescription>Traffic by protocol</CardDescription>
      </CardHeader>
      <CardContent>
        <BandwidthStack samples={samples} protocols={protocols} capacityMbps={1000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Dashed is the link capacity <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          24 hours
        </div>
      </CardFooter>
    </Card>
  )
}
