import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NicheOverlap } from "@/components/charts/lib/ecology"
const axis = ["<2mm", "2–4", "4–6", "6–8", "8–10", "10–14", ">14mm"]
const species = [
  { name: "G. fuliginosa", use: [42, 68, 51, 22, 8, 2, 0] },
  { name: "G. fortis", use: [8, 31, 62, 74, 48, 19, 4] },
  { name: "G. magnirostris", use: [0, 2, 9, 26, 58, 71, 44] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Niche overlap</CardTitle>
        <CardDescription>Resource use across a seed-size axis</CardDescription>
      </CardHeader>
      <CardContent>
        <NicheOverlap axis={axis} species={species} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two finches share 69% of the axis <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Pianka index
        </div>
      </CardFooter>
    </Card>
  )
}
