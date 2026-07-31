import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Imposition } from "@/components/charts/lib/printing"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Imposition</CardTitle>
        <CardDescription>What actually fits once trim and gripper come off</CardDescription>
      </CardHeader>
      <CardContent>
        <Imposition
          sheet={{ widthMm: 1000, heightMm: 707 }}
          page={{ widthMm: 210, heightMm: 297 }}
          gripperMm={12}
          trimMm={3}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Rotating the page gains one per sheet <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          B1 press sheet
        </div>
      </CardFooter>
    </Card>
  )
}
