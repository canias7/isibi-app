import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LegacyProjection } from "@/components/charts/lib/fundraising"
let s = 404
const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
const pledges = Array.from({ length: 140 }, (_, i) => ({
  name: `Pledger ${i + 1}`,
  age: 62 + Math.round(rnd() * 28),
  expectedValue: 14000 + Math.round(Math.pow(rnd(), 2.4) * 180000),
  retentionProbability: 0.8 + rnd() * 0.16,
}))
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Legacy pledges</CardTitle>
        <CardDescription>A mortality calculation, not a pipeline</CardDescription>
      </CardHeader>
      <CardContent>
        <LegacyProjection pledges={pledges} yearsAhead={10} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Treating pledges as this year's income sets an impossible target <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Ten years ahead
        </div>
      </CardFooter>
    </Card>
  )
}
