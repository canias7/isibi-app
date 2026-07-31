import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ErlangBlocking } from "@/components/charts/lib/telecom"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Erlang B</CardTitle>
        <CardDescription>Blocking probability against circuit count</CardDescription>
      </CardHeader>
      <CardContent>
        <ErlangBlocking offeredErlangs={22} maxCircuits={44} targetGrade={0.01} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The last circuits sit idle almost always <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          22 erlangs offered
        </div>
      </CardFooter>
    </Card>
  )
}
