import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CpueTrend } from "@/components/charts/lib/fisheries"
const years = [
  { year: 2015, landingsT: 8420, daysAtSea: 4210, vessels: 62 },
  { year: 2016, landingsT: 8010, daysAtSea: 3880, vessels: 58 },
  { year: 2017, landingsT: 7640, daysAtSea: 3510, vessels: 54 },
  { year: 2018, landingsT: 7290, daysAtSea: 3140, vessels: 49 },
  { year: 2019, landingsT: 7110, daysAtSea: 2880, vessels: 46 },
  { year: 2020, landingsT: 6480, daysAtSea: 2410, vessels: 41 },
  { year: 2021, landingsT: 6720, daysAtSea: 2360, vessels: 40 },
  { year: 2022, landingsT: 6910, daysAtSea: 2280, vessels: 38 },
  { year: 2023, landingsT: 7180, daysAtSea: 2240, vessels: 37 },
  { year: 2024, landingsT: 7420, daysAtSea: 2190, vessels: 36 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Catch per day</CardTitle>
        <CardDescription>Landings corrected for effort</CardDescription>
      </CardHeader>
      <CardContent>
        <CpueTrend years={years} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The fleet shrank, so the landings lied <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Demersal trawl
        </div>
      </CardFooter>
    </Card>
  )
}
