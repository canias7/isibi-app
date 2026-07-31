import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PatchLatency } from "@/components/charts/lib/netsec"
let s = 9
const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const items = Array.from({ length: 46 }, (_, i) => ({
  cve: `CVE-2026-${1000 + i}`,
  days: Math.round(2 + Math.pow(r(), 2.2) * 74),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Disclosure to deployment</CardTitle>
        <CardDescription>Days per vulnerability</CardDescription>
      </CardHeader>
      <CardContent>
        <PatchLatency items={items} slaDays={30} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Sorted, against the SLA <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Last quarter
        </div>
      </CardFooter>
    </Card>
  )
}
