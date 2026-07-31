import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TypeScale } from "@/components/charts/lib/design"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Modular type scale</CardTitle>
        <CardDescription>Rendered at its actual sizes</CardDescription>
      </CardHeader>
      <CardContent>
        <TypeScale base={16} ratio={1.25} steps={7} from={-2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Every size is base × ratio^step <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Major third
        </div>
      </CardFooter>
    </Card>
  )
}
