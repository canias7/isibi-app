import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ContributorLoad } from "@/components/charts/lib/publish"
let s = 83
const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
const contributors = Array.from({ length: 46 }, (_, i) => ({
  name: `Writer ${i + 1}`,
  pieces: Math.max(1, Math.round(Math.pow(r(), 2.4) * 78)),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who writes it</CardTitle>
        <CardDescription>Pieces per contributor</CardDescription>
      </CardHeader>
      <CardContent>
        <ContributorLoad contributors={contributors} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The solid bars write half of everything <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One quarter
        </div>
      </CardFooter>
    </Card>
  )
}
