import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PeriodicGrid } from "@/components/charts/lib/chem"
const elements = [
  { symbol: "H", group: 1, period: 1, value: 2.2 }, { symbol: "He", group: 18, period: 1, value: 0 },
  { symbol: "Li", group: 1, period: 2, value: 0.98 }, { symbol: "Be", group: 2, period: 2, value: 1.57 },
  { symbol: "B", group: 13, period: 2, value: 2.04 }, { symbol: "C", group: 14, period: 2, value: 2.55 },
  { symbol: "N", group: 15, period: 2, value: 3.04 }, { symbol: "O", group: 16, period: 2, value: 3.44 },
  { symbol: "F", group: 17, period: 2, value: 3.98 }, { symbol: "Ne", group: 18, period: 2, value: 0 },
  { symbol: "Na", group: 1, period: 3, value: 0.93 }, { symbol: "Mg", group: 2, period: 3, value: 1.31 },
  { symbol: "Al", group: 13, period: 3, value: 1.61 }, { symbol: "Si", group: 14, period: 3, value: 1.9 },
  { symbol: "P", group: 15, period: 3, value: 2.19 }, { symbol: "S", group: 16, period: 3, value: 2.58 },
  { symbol: "Cl", group: 17, period: 3, value: 3.16 }, { symbol: "Ar", group: 18, period: 3, value: 0 },
  { symbol: "K", group: 1, period: 4, value: 0.82 }, { symbol: "Ca", group: 2, period: 4, value: 1.0 },
  { symbol: "Fe", group: 8, period: 4, value: 1.83 }, { symbol: "Cu", group: 11, period: 4, value: 1.9 },
  { symbol: "Zn", group: 12, period: 4, value: 1.65 }, { symbol: "Br", group: 17, period: 4, value: 2.96 },
  { symbol: "Rb", group: 1, period: 5, value: 0.82 }, { symbol: "Ag", group: 11, period: 5, value: 1.93 },
  { symbol: "I", group: 17, period: 5, value: 2.66 }, { symbol: "Cs", group: 1, period: 6, value: 0.79 },
  { symbol: "Au", group: 11, period: 6, value: 2.54 }, { symbol: "Pb", group: 14, period: 6, value: 2.33 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Electronegativity</CardTitle>
        <CardDescription>The table's own layout is the trend</CardDescription>
      </CardHeader>
      <CardContent>
        <PeriodicGrid elements={elements} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Rises across a period, falls down a group <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Pauling scale
        </div>
      </CardFooter>
    </Card>
  )
}
