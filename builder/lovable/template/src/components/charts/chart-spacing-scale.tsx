import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpacingScale } from "@/components/charts/lib/design"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spacing steps</CardTitle>
        <CardDescription>Shown as the gaps they are</CardDescription>
      </CardHeader>
      <CardContent>
        <SpacingScale base={4} steps={[1, 2, 3, 4, 6, 8, 12, 16, 24]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Adjacent steps must be tellable apart <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          4px base
        </div>
      </CardFooter>
    </Card>
  )
}
