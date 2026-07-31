import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Network, SERVICE_NODES, SERVICE_LINKS } from "./lib/network"

const nodes = [
  { id: "Cut", weight: 9, x: 0.5, y: 0.5 },
  { id: "Beard", weight: 6, x: 0.2, y: 0.25 },
  { id: "Colour", weight: 4, x: 0.8, y: 0.25 },
  { id: "Towel", weight: 3, x: 0.2, y: 0.78 },
  { id: "Kids", weight: 2, x: 0.8, y: 0.78 },
  { id: "Wash", weight: 5, x: 0.5, y: 0.9 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Network</CardTitle>
        <CardDescription>Supplied positions, bowed links.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Network nodes={nodes} links={SERVICE_LINKS} layout="given" size={280} curved />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cut sits at the centre <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
