import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HarrisMatrix } from "@/components/charts/lib/archaeology"
const contexts = [
  { id: "101 topsoil", kind: "layer" as const, above: ["102 subsoil"] },
  { id: "102 subsoil", kind: "layer" as const, above: ["103 wall", "107 yard"] },
  { id: "103 wall", kind: "structure" as const, above: ["104 foundation"] },
  { id: "107 yard", kind: "layer" as const, above: ["104 foundation"] },
  { id: "104 foundation", kind: "structure" as const, above: ["105 fill"] },
  { id: "105 fill", kind: "fill" as const, above: ["106 cut"] },
  { id: "106 cut", kind: "cut" as const, above: ["108 natural"] },
  { id: "108 natural", kind: "layer" as const },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stratigraphic sequence</CardTitle>
        <CardDescription>Levels derived from the recorded contacts</CardDescription>
      </CardHeader>
      <CardContent>
        <HarrisMatrix contexts={contexts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Same row means no recorded relationship <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Trench 4
        </div>
      </CardFooter>
    </Card>
  )
}
