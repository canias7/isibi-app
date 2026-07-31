import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReserveRunoff } from "@/components/charts/lib/actuarial"
const pattern = [0.42, 0.24, 0.14, 0.09, 0.06, 0.03]
const cohorts = [
  { year: "2019", ultimate: 8_400_000 },
  { year: "2020", ultimate: 6_900_000 },
  { year: "2021", ultimate: 9_200_000 },
  { year: "2022", ultimate: 10_100_000 },
  { year: "2023", ultimate: 11_400_000 },
  { year: "2024", ultimate: 12_800_000 },
].map((c, i, all) => ({
  ...c,
  paid: pattern.slice(0, all.length - i).map((p) => Math.round(c.ultimate * p)),
}))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reserve run-off</CardTitle>
        <CardDescription>How the ultimate emerges</CardDescription>
      </CardHeader>
      <CardContent>
        <ReserveRunoff cohorts={cohorts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The youngest year is the one nobody knows <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six accident years
        </div>
      </CardFooter>
    </Card>
  )
}
