import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Marimekko, SERVICE_MIX } from "./lib/marimekko"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Marimekko</CardTitle>
        <CardDescription>Without column labels.</CardDescription>
      </CardHeader>
      <CardContent>
        <Marimekko columns={SERVICE_MIX} showColumnLabels={false} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour is mostly new customers <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
