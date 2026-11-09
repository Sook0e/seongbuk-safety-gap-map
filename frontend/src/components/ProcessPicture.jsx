import { Fragment } from 'react'
import { residentAsset } from './ResidentHeader.jsx'

const STEPS = [
  ['사진 제보', 'home-imgCamera.svg'],
  ['담당자 검토', 'home-imgList.svg'],
  ['현장 조치', 'home-imgMap.svg'],
  ['결과 확인', 'process-result.svg'],
]

export default function ProcessPicture() {
  return (
    <ol aria-label="제보 과정" className="grid grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-start gap-1">
      {STEPS.map(([title, icon], index) => (
        <Fragment key={title}>
          {index > 0 && <li aria-hidden="true" className="mt-3.5"><img src={residentAsset('process-arrow.svg')} alt="" /></li>}
          <li className="grid min-w-0 justify-items-center gap-1.5 text-center">
            <span className="grid h-10 w-full max-w-[52px] place-items-center rounded-xl bg-white"><img src={residentAsset(icon)} alt="" /></span>
            <span className="text-[11px] font-bold leading-tight">{title}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  )
}
