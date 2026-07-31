import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StereoField } from "@/components/charts/lib/music2"
const elements = [
  { name: "Kick", pan: 0, width: 0.05, level: 0.95 },
  { name: "Snare", pan: 0.04, width: 0.1, level: 0.9 },
  { name: "Bass", pan: 0, width: 0.06, level: 0.88 },
  { name: "Overheads", pan: 0, width: 0.85, level: 0.6 },
  { name: "Gtr L", pan: -0.62, width: 0.2, level: 0.7 },
  { name: "Gtr R", pan: -0.55, width: 0.22, level: 0.68 },
  { name: "Keys", pan: 0.34, width: 0.45, level: 0.55 },
  { name: "Lead vox", pan: 0, width: 0.08, level: 1 },
  { name: "BVs", pan: 0.1, width: 0.7, level: 0.42 },
  { name: "Shaker", pan: 0.72, width: 0.12, level: 0.3 },
  { name: "Tamb", pan: -0.78, width: 0.12, level: 0.28 },
  { name: "Pad", pan: 0, width: 0.95, level: 0.34 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stereo field</CardTitle>
        <CardDescription>Where each source sits and how wide</CardDescription>
      </CardHeader>
      <CardContent>
        <StereoField elements={elements} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two guitars occupy the same slot <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Twelve sources
        </div>
      </CardFooter>
    </Card>
  )
}
