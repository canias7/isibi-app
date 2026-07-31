import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StockBiomass } from "@/components/charts/lib/fisheries"
const years = [
  { year: 2010, ssbT: 71000 }, { year: 2011, ssbT: 64000 }, { year: 2012, ssbT: 58000 },
  { year: 2013, ssbT: 49000 }, { year: 2014, ssbT: 42000 }, { year: 2015, ssbT: 38000 },
  { year: 2016, ssbT: 41000 }, { year: 2017, ssbT: 47000 }, { year: 2018, ssbT: 56000 },
  { year: 2019, ssbT: 68000 }, { year: 2020, ssbT: 79000 }, { year: 2021, ssbT: 86000 },
  { year: 2022, ssbT: 91000 }, { year: 2023, ssbT: 88000 }, { year: 2024, ssbT: 94000 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spawning stock</CardTitle>
        <CardDescription>Tonnage against the reference points</CardDescription>
      </CardHeader>
      <CardContent>
        <StockBiomass years={years} bLim={40000} bPa={62000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The tonnage is the input, the status is the answer <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          North Sea, assessed
        </div>
      </CardFooter>
    </Card>
  )
}
