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

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Network</CardTitle>
        <CardDescription>Shape only.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Network nodes={SERVICE_NODES} links={SERVICE_LINKS} showLabels={false} />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cut and beard go together <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
