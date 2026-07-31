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
  { id: "Ada", weight: 8 }, { id: "Mo", weight: 3 }, { id: "Sam", weight: 5 },
  { id: "Rae", weight: 2 }, { id: "Jo", weight: 4 }, { id: "Kit", weight: 1 }, { id: "Lee", weight: 3 },
]
const links = [
  { source: "Ada", target: "Mo", value: 3 },
  { source: "Ada", target: "Sam", value: 4 },
  { source: "Ada", target: "Rae", value: 2 },
  { source: "Sam", target: "Jo", value: 3 },
  { source: "Jo", target: "Kit", value: 1 },
  { source: "Sam", target: "Lee", value: 2 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Network</CardTitle>
        <CardDescription>Who referred whom.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Network nodes={nodes} links={links} curved size={280} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Ada brings the most people in <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
