import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { YarnCount } from "@/components/charts/lib/textile"
const yarns = [
  { name: "Fine shirting warp", ne: 100 },
  { name: "Poplin weft", ne: 60 },
  { name: "Denim warp", ne: 12 },
  { name: "Worsted suiting", nm: 60 },
  { name: "Polyester filament", denier: 300 },
  { name: "Canvas", tex: 98 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Yarn count</CardTitle>
        <CardDescription>The same yarn in every system</CardDescription>
      </CardHeader>
      <CardContent>
        <YarnCount yarns={yarns} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A bigger tex is thicker, a bigger Ne is finer <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Converted, not tabulated
        </div>
      </CardFooter>
    </Card>
  )
}
