import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HardnessScale } from "@/components/charts/lib/materials"
const items = [
  { name: "Talc", mohs: 1, absoluteGpa: 0.03 }, { name: "Gypsum", mohs: 2, absoluteGpa: 0.4 },
  { name: "Calcite", mohs: 3, absoluteGpa: 1.4 }, { name: "Fluorite", mohs: 4, absoluteGpa: 2.1 },
  { name: "Apatite", mohs: 5, absoluteGpa: 4.8 }, { name: "Orthoclase", mohs: 6, absoluteGpa: 6.5 },
  { name: "Quartz", mohs: 7, absoluteGpa: 11 }, { name: "Topaz", mohs: 8, absoluteGpa: 14 },
  { name: "Corundum", mohs: 9, absoluteGpa: 21 }, { name: "Diamond", mohs: 10, absoluteGpa: 90 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How hard is hard</CardTitle>
        <CardDescription>Ordinal Mohs against measured</CardDescription>
      </CardHeader>
      <CardContent>
        <HardnessScale items={items} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Ordinal means the numbers are ranks <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Nine minerals
        </div>
      </CardFooter>
    </Card>
  )
}
