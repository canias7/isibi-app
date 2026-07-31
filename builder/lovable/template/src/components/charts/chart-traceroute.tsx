import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Traceroute } from "@/components/charts/lib/netsec"
const hops = [
  { n: 1, host: "192.168.1.1", ms: 0.8 },
  { n: 2, host: "10.44.0.1", ms: 6.2, asn: "AS12345" },
  { n: 3, host: "core1.lon", ms: 8.1, asn: "AS12345" },
  { n: 4, host: "peer.lon-ams", ms: 14.6, asn: "AS3356" },
  { n: 5, host: null as unknown as string, ms: null },
  { n: 6, host: "ams-ix", ms: 92.4, asn: "AS1200" },
  { n: 7, host: "edge.fra", ms: 96.1, asn: "AS1200" },
  { n: 8, host: "target", ms: 97.8, asn: "AS64500" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Path to the host</CardTitle>
        <CardDescription>What each hop adds</CardDescription>
      </CardHeader>
      <CardContent>
        <Traceroute hops={hops.map((h) => ({ ...h, host: h.host ?? "* * *" }))} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The increment names the bad link <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          ICMP
        </div>
      </CardFooter>
    </Card>
  )
}
