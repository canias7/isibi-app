import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { JitterBuffer } from "@/components/charts/lib/telecom"
let s = 5
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const arrivals = Array.from({ length: 4000 }, () => {
  const base = 42 + (rnd() - 0.5) * 6
  return rnd() < 0.04 ? base + Math.pow(rnd(), 0.4) * 90 : base
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Jitter buffer</CardTitle>
        <CardDescription>Late packets against added delay</CardDescription>
      </CardHeader>
      <CardContent>
        <JitterBuffer arrivals={arrivals} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every millisecond bought costs the same millisecond <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          VoIP, 4,000 packets
        </div>
      </CardFooter>
    </Card>
  )
}
