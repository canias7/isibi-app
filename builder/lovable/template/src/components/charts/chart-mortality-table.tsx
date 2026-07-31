import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MortalityTable } from "@/components/charts/lib/insure"
const build = (hump: number, level: number) =>
  Array.from({ length: 96 }, (_, age) => ({
    age,
    qx: Number((
      0.0009 * Math.exp(-age / 1.6) +
      0.00006 +
      hump * Math.exp(-((age - 22) ** 2) / 90) +
      level * Math.exp(0.0925 * age) * 0.000012
    ).toFixed(6)),
  }))
const rows = [
  ...build(0.00075, 1).map((r) => ({ ...r, sex: "male" })),
  ...build(0.00022, 0.62).map((r) => ({ ...r, sex: "female" })),
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mortality by age</CardTitle>
        <CardDescription>qx on a log scale</CardDescription>
      </CardHeader>
      <CardContent>
        <MortalityTable rows={rows} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The accident hump needs the log axis <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Period table
        </div>
      </CardFooter>
    </Card>
  )
}
